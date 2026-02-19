import { Trigger, TriggerCallback, TriggerOptions } from './Trigger.js';

/**
 * Manages outbound triggers that fire when commands are sent to the server.
 * This allows scripts to react to outgoing commands, whether sent programmatically
 * via send() or typed by the user.
 */
export class OutboundTriggerManager {
  private triggers: Trigger[] = [];

  /**
   * Create a new outbound trigger
   * @param pattern - Pattern to match against outgoing commands (literal string or regex)
   * @param callback - Function to execute when matched
   * @param options - Optional configuration
   * @returns The created trigger's ID
   */
  createOutboundTrigger(
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
   * Remove an outbound trigger by ID
   * @param id - Trigger ID to remove
   * @returns True if trigger was found and removed
   */
  removeOutboundTrigger(id: string): boolean {
    const index = this.triggers.findIndex((t) => t.id === id);
    if (index >= 0) {
      this.triggers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Enable an outbound trigger
   * @param id - Trigger ID to enable
   */
  enableOutboundTrigger(id: string): void {
    const trigger = this.triggers.find((t) => t.id === id);
    if (trigger) {
      trigger.enabled = true;
    }
  }

  /**
   * Disable an outbound trigger
   * @param id - Trigger ID to disable
   */
  disableOutboundTrigger(id: string): void {
    const trigger = this.triggers.find((t) => t.id === id);
    if (trigger) {
      trigger.enabled = false;
    }
  }

  /**
   * Process an outgoing command through all outbound triggers.
   * Called before sending a command to the server.
   * @param command - The command being sent
   * @param onError - Optional error handler for Lua errors
   */
  async processCommand(
    command: string,
    onError?: (error: Error) => void
  ): Promise<void> {
    for (const trigger of this.triggers) {
      const result = trigger.match(command);
      if (result.matched) {
        // Execute the trigger callback with error handling
        await trigger.execute(result.captures || [], onError);
      }
    }
  }

  /**
   * Get all outbound triggers
   */
  getOutboundTriggers(): Trigger[] {
    return [...this.triggers];
  }

  /**
   * Clear all outbound triggers
   */
  clearOutboundTriggers(): void {
    this.triggers = [];
  }
}
