import { Telnet } from 'telnet-client';
import { ConnectionManager } from './ConnectionManager.js';
import { decodeCP437 } from '../utils/cp437.js';
import type { ConnectionProfile } from '../state/AppState.js';
import type { SessionLogger } from '../logging/SessionLogger.js';

export class TelnetConnection extends ConnectionManager {
  private client: Telnet;
  private connected: boolean = false;
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
      const payload = data + '\r\n';
      if (this.logger) {
        this.logger.logSend(payload);
      }
      this.client.send(payload).catch((error: unknown) => {
        this.connected = false;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.emitStatus('error', errorMessage);
        this.emitError(error instanceof Error ? error : new Error(errorMessage));
      });
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
