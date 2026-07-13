export interface IdleWatchdogOptions {
  /**
   * Milliseconds of inbound silence after which onWarn fires. Set to 0 to
   * disable the warning entirely (onDead still fires).
   */
  warnMs: number;
  /**
   * Milliseconds of inbound silence after which the connection is presumed
   * dead and onDead fires. Set to 0 to disable the watchdog completely.
   */
  deadMs: number;
  /** Called once when the connection first crosses the warn threshold. */
  onWarn: (idleMs: number) => void;
  /** Called once when the connection crosses the dead threshold. */
  onDead: (idleMs: number) => void;
  /** How often the timer polls the clock. Defaults to 5000ms. */
  checkIntervalMs?: number;
  /** Injectable clock, for tests. Defaults to Date.now. */
  now?: () => number;
}

/**
 * Watches for inbound silence on a connection and fires callbacks when the
 * quiet stretch crosses configurable thresholds.
 *
 * A half-open TCP connection (server crashed, network path died, NAT/firewall
 * evicted the flow) delivers no FIN or RST, so Node's socket never fires
 * 'close' or 'error' — the read just blocks forever. This watchdog is the
 * application-level backstop: it measures the gap since the last inbound byte
 * and, past `deadMs`, declares the connection dead so the app can react
 * instead of hanging indefinitely.
 *
 * Detection here is purely time-based, so `deadMs` must be set comfortably
 * larger than the longest silence a healthy server is expected to produce.
 */
export class IdleWatchdog {
  private readonly warnMs: number;
  private readonly deadMs: number;
  private readonly onWarn: (idleMs: number) => void;
  private readonly onDead: (idleMs: number) => void;
  private readonly checkIntervalMs: number;
  private readonly now: () => number;

  private lastActivity = 0;
  private warned = false;
  private dead = false;
  private running = false;
  private timer?: ReturnType<typeof setInterval>;

  constructor(options: IdleWatchdogOptions) {
    this.warnMs = options.warnMs;
    this.deadMs = options.deadMs;
    this.onWarn = options.onWarn;
    this.onDead = options.onDead;
    this.checkIntervalMs = options.checkIntervalMs ?? 5000;
    this.now = options.now ?? Date.now;
  }

  /**
   * Begin monitoring. No-op when the watchdog is disabled (deadMs <= 0).
   * Resets the activity clock so the first interval starts fresh.
   */
  start(): void {
    if (this.deadMs <= 0) return;
    this.notifyActivity();
    this.dead = false;
    this.running = true;
    this.timer = setInterval(() => this.check(), this.checkIntervalMs);
    // Don't let the poll timer keep the process alive on its own.
    (this.timer as { unref?: () => void }).unref?.();
  }

  /** Stop monitoring and release the timer. Safe to call repeatedly. */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Record that inbound data just arrived. Resets the idle clock and re-arms
   * the warning so it can fire again on the next quiet stretch.
   */
  notifyActivity(): void {
    this.lastActivity = this.now();
    this.warned = false;
  }

  /**
   * Evaluate the current idle gap and fire callbacks as thresholds are
   * crossed. Public so tests can drive it with a controlled clock rather than
   * waiting on real timers.
   */
  check(): void {
    if (!this.running || this.dead || this.deadMs <= 0) return;
    const idleMs = this.now() - this.lastActivity;

    if (this.warnMs > 0 && !this.warned && idleMs >= this.warnMs && idleMs < this.deadMs) {
      this.warned = true;
      this.onWarn(idleMs);
    }

    if (idleMs >= this.deadMs) {
      this.dead = true;
      this.stop();
      this.onDead(idleMs);
    }
  }
}
