export interface TriggerContext {
  isLastLine: boolean;
}

export type TriggerCallback = (
  matches?: string[],
  context?: TriggerContext,
) => void | Promise<void>;

export interface TriggerOptions {
  type?: 'literal' | 'regex';
  enabled?: boolean;
}

export class Trigger {
  public id: string;
  public pattern: string;
  public callback: TriggerCallback;
  public type: 'literal' | 'regex';
  public enabled: boolean;
  private regex?: RegExp;

  constructor(pattern: string, callback: TriggerCallback, options: TriggerOptions = {}) {
    this.id = Math.random().toString(36).substring(2, 15);
    this.pattern = pattern;
    this.callback = callback;
    this.type = options.type || 'literal';
    this.enabled = options.enabled !== false;

    // Compile regex if needed
    if (this.type === 'regex') {
      this.regex = new RegExp(this.pattern);
    }
  }

  /**
   * Test if this trigger matches the given text
   * @param text - Text to match against
   * @returns Match result with captures if matched
   */
  match(text: string): { matched: boolean; captures?: string[] } {
    if (!this.enabled) {
      return { matched: false };
    }

    if (this.type === 'literal') {
      const matched = text.includes(this.pattern);
      return { matched };
    }
    const match = this.regex?.exec(text);
    if (match) {
      // Return full match and captured groups
      // matches[0] in JS becomes matches[1] in Lua (full match)
      // matches[1] in JS becomes matches[2] in Lua (first capture)
      const captures = Array.from(match);
      return { matched: true, captures };
    }
    return { matched: false };
  }

  /**
   * Execute the trigger callback
   * @param captures - Captured groups from regex match
   * @param onError - Optional error handler for Lua errors
   */
  async execute(
    captures?: string[],
    onError?: (error: Error) => void,
    context?: TriggerContext,
  ): Promise<void> {
    try {
      await this.callback(captures, context);
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      } else {
        // Re-throw if no error handler provided
        throw error;
      }
    }
  }
}
