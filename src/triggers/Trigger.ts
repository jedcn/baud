export type TriggerCallback = (matches?: string[]) => void | Promise<void>;

export interface TriggerOptions {
  type?: 'literal' | 'regex';
  enabled?: boolean;
  priority?: number;
  gag?: boolean;
}

export class Trigger {
  public id: string;
  public pattern: string;
  public callback: TriggerCallback;
  public type: 'literal' | 'regex';
  public enabled: boolean;
  public priority: number;
  public gag: boolean;
  private regex?: RegExp;

  constructor(
    pattern: string,
    callback: TriggerCallback,
    options: TriggerOptions = {}
  ) {
    this.id = Math.random().toString(36).substring(2, 15);
    this.pattern = pattern;
    this.callback = callback;
    this.type = options.type || 'literal';
    this.enabled = options.enabled !== false;
    this.priority = options.priority || 0;
    this.gag = options.gag || false;

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
   * Execute the trigger callback
   * @param captures - Captured groups from regex match
   */
  async execute(captures?: string[]): Promise<void> {
    await this.callback(captures);
  }
}
