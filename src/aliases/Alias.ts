export type AliasCallback = (matches?: string[]) => void | Promise<void>;

export interface AliasOptions {
  type?: 'literal' | 'regex';
  enabled?: boolean;
}

export class Alias {
  public id: string;
  public pattern: string;
  public callback: AliasCallback;
  public type: 'literal' | 'regex';
  public enabled: boolean;
  private regex?: RegExp;

  constructor(
    pattern: string,
    callback: AliasCallback,
    options: AliasOptions = {}
  ) {
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
   * Test if this alias matches the given text
   * @param text - Text to match against
   * @returns Match result with captures if matched
   */
  match(text: string): { matched: boolean; captures?: string[] } {
    if (!this.enabled) {
      return { matched: false };
    }

    if (this.type === 'literal') {
      const matched = text === this.pattern;
      return { matched };
    } else {
      const match = this.regex?.exec(text);
      if (match) {
        // Return captured groups (excluding the full match at index 0)
        const captures = match.slice(1);
        return { matched: true, captures };
      }
      return { matched: false };
    }
  }

  /**
   * Execute the alias callback
   * @param captures - Captured groups from regex match
   * @param onError - Optional error handler for Lua errors
   */
  async execute(
    captures?: string[],
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      await this.callback(captures);
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
