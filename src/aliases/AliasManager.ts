import { Alias, type AliasCallback, type AliasOptions } from './Alias.js';

export class AliasManager {
  private aliases: Alias[] = [];

  /**
   * Create a new alias
   * @param pattern - Pattern to match (literal string or regex)
   * @param callback - Function to execute when matched
   * @param options - Optional configuration
   * @returns The created alias's ID
   */
  createAlias(pattern: string, callback: AliasCallback, options?: AliasOptions): string {
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
   * @param onError - Called if the alias callback throws
   * @param onMatch - Called once a match is found, BEFORE the callback runs
   * @returns True if an alias matched and was executed (input should be consumed)
   */
  async processInput(
    text: string,
    onError?: (error: Error) => void,
    onMatch?: () => void,
  ): Promise<boolean> {
    for (const alias of this.aliases) {
      const result = alias.match(text);

      if (result.matched) {
        // Before the callback, not after. The callback usually sends to the
        // server -- every movement alias does -- so a caller that logs the alias
        // once processInput returns records it BELOW the traffic it caused.
        // Ordering is most of what a log is worth to anyone replaying a session.
        onMatch?.();
        // Execute the alias callback with error handling
        await alias.execute(result.captures || [], onError);
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
