import type { Socket } from 'node:net';
import { Telnet } from 'telnet-client';
import type { SessionLogger } from '../logging/SessionLogger.js';
import type { ConnectionProfile } from '../state/AppState.js';
import { decodeCP437 } from '../utils/cp437.js';
import { ConnectionManager } from './ConnectionManager.js';

export class TelnetConnection extends ConnectionManager {
  private client: Telnet;
  private connected = false;
  private logger?: SessionLogger;

  constructor(logger?: SessionLogger) {
    super();
    this.client = new Telnet();
    this.logger = logger;
  }

  async connect(profile: ConnectionProfile): Promise<void> {
    this.profile = profile;
    this.emitStatus('connecting');

    try {
      this.client.on('data', (buffer: Buffer) => {
        if (this.logger) {
          this.logger.logRecv(buffer);
        }
        const text = decodeCP437(buffer);
        this.emitData(text);
      });

      this.client.on('close', () => {
        this.connected = false;
        this.emitStatus('disconnected');
      });

      this.client.on('error', (error: Error) => {
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
      this.emitStatus('connected');
    } catch (error) {
      this.connected = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatus('error', errorMessage);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.end();
      this.connected = false;
    }
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
