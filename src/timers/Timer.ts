export type TimerCallback = () => void | Promise<void>;

export interface TimerOptions {
  repeating?: boolean;
  enabled?: boolean;
  name?: string;
}

export class Timer {
  public id: string;
  public interval: number;
  public callback: TimerCallback;
  public repeating: boolean;
  public enabled: boolean;
  public running = false;
  public name?: string;
  private timeoutId?: ReturnType<typeof setTimeout>;
  private intervalId?: ReturnType<typeof setInterval>;
  private onError?: (error: Error) => void;

  constructor(interval: number, callback: TimerCallback, options: TimerOptions = {}) {
    this.id = Math.random().toString(36).substring(2, 15);
    this.interval = interval;
    this.callback = callback;
    this.repeating = options.repeating !== false;
    this.enabled = options.enabled !== false;
    this.name = options.name;
  }

  /**
   * Set error handler for automatic execution
   */
  setErrorHandler(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  /**
   * Start the timer
   */
  start(): void {
    if (!this.enabled || this.running) {
      return;
    }

    this.running = true;

    if (this.repeating) {
      this.intervalId = setInterval(() => {
        this.execute(this.onError);
      }, this.interval);
    } else {
      this.timeoutId = setTimeout(() => {
        this.execute(this.onError);
        this.running = false;
      }, this.interval);
    }
  }

  /**
   * Stop the timer without resetting
   */
  stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.running = false;
  }

  /**
   * Stop and restart the timer
   */
  reset(): void {
    this.stop();
    this.start();
  }

  /**
   * Execute the timer callback
   * @param onError - Optional error handler for Lua errors
   */
  async execute(onError?: (error: Error) => void): Promise<void> {
    try {
      await this.callback();
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  }
}
