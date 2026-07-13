import type { Socket } from 'node:net';
import { Telnet } from 'telnet-client';
import type { SessionLogger } from '../logging/SessionLogger.js';
import type { ConnectionProfile } from '../state/AppState.js';
import { decodeCP437 } from '../utils/cp437.js';
import { ConnectionManager } from './ConnectionManager.js';
import { IdleWatchdog } from './IdleWatchdog.js';

/** How often the OS should send TCP keepalive probes on an idle socket. */
const KEEPALIVE_DELAY_MS = 30_000;

export interface TelnetConnectionOptions {
  logger?: SessionLogger;
  /** Inbound silence (ms) before a visible warning. 0 disables the warning. */
  idleWarnMs?: number;
  /** Inbound silence (ms) before the connection is declared dead. 0 disables. */
  idleDeadMs?: number;
}

export class TelnetConnection extends ConnectionManager {
  private client: Telnet;
  private connected = false;
  private logger?: SessionLogger;
  private readonly idleWarnMs: number;
  private readonly idleDeadMs: number;
  private watchdog?: IdleWatchdog;

  constructor(options?: SessionLogger | TelnetConnectionOptions) {
    super();
    this.client = new Telnet();
    // Backwards-compatible: callers may pass a bare logger (the original
    // single-argument form) or an options object.
    const opts: TelnetConnectionOptions =
      options && 'logSend' in options ? { logger: options } : (options ?? {});
    this.logger = opts.logger;
    this.idleWarnMs = opts.idleWarnMs ?? 0;
    this.idleDeadMs = opts.idleDeadMs ?? 0;
  }

  async connect(profile: ConnectionProfile): Promise<void> {
    this.profile = profile;
    this.emitStatus('connecting');

    try {
      this.client.on('data', (buffer: Buffer) => {
        // Any inbound byte proves the connection is alive; re-arm the watchdog.
        this.watchdog?.notifyActivity();
        if (this.logger) {
          this.logger.logRecv(buffer);
        }
        const text = decodeCP437(buffer);
        this.emitData(text);
      });

      this.client.on('close', () => {
        this.connected = false;
        this.watchdog?.stop();
        this.emitStatus('disconnected');
      });

      this.client.on('error', (error: Error) => {
        this.watchdog?.stop();
        this.emitStatus('error', error.message);
        this.emitError(error);
      });

      await this.client.connect({
        host: profile.host,
        port: profile.port,
        negotiationMandatory: false,
        timeout: 5000,
        sendTimeout: 0,
      });

      this.connected = true;

      // Ask the OS to probe idle connections so a half-open socket eventually
      // surfaces as a real 'error'/'close' instead of blocking forever.
      this.socket?.setKeepAlive(true, KEEPALIVE_DELAY_MS);

      this.startWatchdog();

      this.emitStatus('connected');
    } catch (error) {
      this.connected = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatus('error', errorMessage);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.watchdog?.stop();
    if (this.connected) {
      await this.client.end();
      this.connected = false;
    }
  }

  // Start the idle watchdog if it's been configured. Silence past the warn
  // threshold surfaces a visible notice; silence past the dead threshold
  // presumes the socket is half-open and signals 'stalled' so the app can
  // exit rather than hang.
  private startWatchdog(): void {
    if (this.idleDeadMs <= 0) return;
    this.watchdog = new IdleWatchdog({
      warnMs: this.idleWarnMs,
      deadMs: this.idleDeadMs,
      onWarn: (idleMs) => {
        this.emitIdleWarning(idleMs);
      },
      onDead: (idleMs) => {
        this.connected = false;
        const seconds = Math.round(idleMs / 1000);
        this.emitStalled(
          `No data received for ${seconds}s (idle timeout). The server likely dropped the connection without notifying us.`,
        );
      },
    });
    this.watchdog.start();
  }

  send(data: string): void {
    if (this.connected) {
      const payload = `${data}\r\n`;
      if (this.logger) {
        this.logger.logSend(payload);
      }
      // Write straight to the underlying socket rather than going through
      // telnet-client's `send()`. That method wraps every call in a Promise
      // and attaches a one-shot 'data' listener to capture the command's
      // "response" — but we never consume the Promise (we read all inbound
      // bytes via the persistent 'data' listener installed in connect()), and
      // because we configure `sendTimeout: 0` that per-send listener is only
      // removed when the next inbound 'data' event arrives. A burst of sends
      // with no intervening server output therefore stacks listeners until
      // Node warns "Possible EventTarget memory leak detected. N data
      // listeners added to [Socket]". Writing directly skips that machinery
      // entirely. It also drops the spurious extra `ors` newline that send()
      // appends on top of our own `\r\n`, leaving a clean telnet line.
      this.socket?.write(payload);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // telnet-client keeps the connected net.Socket on a private field; reach it
  // through a narrow cast so we can write outbound bytes ourselves.
  private get socket(): Socket | undefined {
    return (this.client as unknown as { socket: Socket | null }).socket ?? undefined;
  }
}
