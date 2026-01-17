import { Telnet } from 'telnet-client';
import { ConnectionManager } from './ConnectionManager.js';
import type { ConnectionProfile } from '../state/AppState.js';

export class TelnetConnection extends ConnectionManager {
  private client: Telnet;
  private connected: boolean = false;

  constructor() {
    super();
    this.client = new Telnet();
  }

  async connect(profile: ConnectionProfile): Promise<void> {
    this.profile = profile;
    this.emitStatus('connecting');

    try {
      this.client.on('data', (buffer: Buffer) => {
        const text = buffer.toString('utf8');
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
      this.client.send(data + '\r\n');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
