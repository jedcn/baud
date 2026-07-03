import { Timer, type TimerCallback, type TimerOptions } from './Timer.js';

export class TimerManager {
  private timers: Timer[] = [];
  private errorHandler?: (error: Error) => void;

  /**
   * Set error handler for all timer callbacks
   */
  setErrorHandler(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Create a new timer
   * @param interval - Milliseconds between executions
   * @param callback - Function to execute
   * @param options - Optional configuration
   * @returns The created timer's ID
   */
  createTimer(interval: number, callback: TimerCallback, options?: TimerOptions): string {
    const timer = new Timer(interval, callback, options);

    if (this.errorHandler) {
      timer.setErrorHandler(this.errorHandler);
    }

    this.timers.push(timer);
    timer.start();

    return timer.id;
  }

  /**
   * Remove a timer by ID
   * @param id - Timer ID to remove
   * @returns True if timer was found and removed
   */
  removeTimer(id: string): boolean {
    const index = this.timers.findIndex((t) => t.id === id);
    if (index >= 0) {
      this.timers[index].stop();
      this.timers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Enable a timer
   * @param id - Timer ID to enable
   */
  enableTimer(id: string): void {
    const timer = this.timers.find((t) => t.id === id);
    if (timer) {
      timer.enabled = true;
      timer.start();
    }
  }

  /**
   * Disable a timer
   * @param id - Timer ID to disable
   */
  disableTimer(id: string): void {
    const timer = this.timers.find((t) => t.id === id);
    if (timer) {
      timer.stop();
      timer.enabled = false;
    }
  }

  /**
   * Get all timers
   */
  getTimers(): Timer[] {
    return [...this.timers];
  }

  /**
   * Clear all timers
   */
  clearTimers(): void {
    for (const timer of this.timers) {
      timer.stop();
    }
    this.timers = [];
  }

  /**
   * Stop all timers (for cleanup)
   */
  stopAll(): void {
    for (const timer of this.timers) {
      timer.stop();
    }
  }
}
